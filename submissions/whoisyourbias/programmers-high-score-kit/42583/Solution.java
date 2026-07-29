import java.util.Arrays;
import java.util.LinkedList;

class Solution {
    public int solution(int bridge_length, int weight, int[] truck_weights) {
		LinkedList<Integer> weights = new LinkedList<>();
		LinkedList<TruckStatus> bridge = new LinkedList<>();

		// 오름차순
		for (int i = 0 ; i < truck_weights.length; i++) {
			weights.add(truck_weights[i]);
		}

		int t = 0;
		int cur_bridge = 0;
		int cur_weight = 0;

		while (true) {
            // System.out.println("t:" + t + ":"+bridge);
			if (weights.size() == 0 && bridge.size() == 0)
				break;

			if (cur_bridge < bridge_length && cur_weight < weight && 
					(weights.size() != 0 &&  weights.peekFirst() + cur_weight <= weight)) {
				// 넣기 가능하면 1개 넣기.
				bridge.addLast(new TruckStatus(weights.pollFirst()));
                cur_bridge +=1;
                cur_weight += bridge.peekLast().weight;
			}


			// every truck ticks
			for (int i = 0; i < bridge.size(); i++) {
				TruckStatus b = bridge.pollFirst();
				b.tick();
				if (!b.isEnd(bridge_length)) {
					bridge.addLast(b);
				} else {
                    i--;
                    cur_bridge -=1;
                    cur_weight -= b.weight;
                }
			}
			t++;
		}

		return t + 1;
    }
}

class TruckStatus {
	int timeInBridge;
	int weight;

	TruckStatus(int weight) {
		this.timeInBridge = 0;
		this.weight = weight;
	}

	public void tick() {
		this.timeInBridge++;
	}

	public boolean isEnd(int bridge_length) {
		if (timeInBridge >= bridge_length) 
			return true;
		return false;
	}
    
    @Override
    public String toString() {
        return "tib:" + timeInBridge + "weight:" + weight;
    }
}

