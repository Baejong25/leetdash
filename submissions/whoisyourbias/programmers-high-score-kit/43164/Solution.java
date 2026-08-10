import java.util.*;
import java.util.LinkedList;

class Solution {
    static String[] answer;
    public String[] solution(String[][] tickets) {
        answer = null;
		boolean[] used = new boolean[tickets.length];
		LinkedList<BFSStatus> queue = new LinkedList<>();

		for (int i = 0; i  < tickets.length; i++) {
			if (tickets[i][0].equals("ICN")) {
				boolean[] usedCpy = used.clone();
				usedCpy[i] = true;
				queue.add(
						new BFSStatus(tickets[i][1], usedCpy)
						);
			}
		}

		while (!queue.isEmpty()) {
			BFSStatus s = queue.pollFirst();
			BFS(s, queue, tickets);
		}
		return answer;
    }

	private void BFS(BFSStatus s, LinkedList<BFSStatus> q, String[][] tickets) {
		if (s.usedCnt == s.used.length) {
			if (answer == null) {
				answer = s.lst.toArray(new String[0]);
			} else {
                for (int i = 0 ; i < answer.length; i++) {
					if (answer[i].equals(s.lst.get(i))) {
						continue;
					} else if (answer[i].compareTo(s.lst.get(i)) > 0) {
						answer = s.lst.toArray(new String[0]);
                        break;
					} else {
                        break;
					}
				}
			}
		}

		for (int i = 0 ; i < tickets.length; i++) {
			if (s.used[i])
				continue;
			
			if (tickets[i][0].equals(s.currentAirport)) {
				boolean[] usedCpy = s.used.clone();
				usedCpy[i] = true;
				q.add(
					new BFSStatus(tickets[i][1], 
						usedCpy, 
						s.usedCnt + 1,
						(ArrayList<String>) s.lst.clone())
						);
			}
		}
	}


	class BFSStatus {
		ArrayList<String> lst;
		String currentAirport;
		boolean[] used;
		int usedCnt;
		BFSStatus(String currentAirport, boolean[] used) {
			this.lst = new ArrayList<>();
			lst.add("ICN");
			lst.add(currentAirport);
			this.currentAirport = currentAirport;
			this.used = used;
			this.usedCnt = 1;
		}
		BFSStatus(String currentAirport, boolean[] used, int usedCnt, ArrayList<String> lst) {
			this.lst = (ArrayList<String>) lst;
			this.lst.add(currentAirport);
			this.currentAirport = currentAirport;
			this.used = used;
			this.usedCnt = usedCnt;
		}
	}
}
