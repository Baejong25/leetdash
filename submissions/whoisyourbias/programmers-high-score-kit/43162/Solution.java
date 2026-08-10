/**
 *
 *
 *
 *
 *
 *
컴퓨터의 개수 n은 1 이상 200 이하인 자연수입니다.
각 컴퓨터는 0부터 n-1인 정수로 표현합니다.
i번 컴퓨터와 j번 컴퓨터가 연결되어 있으면 computers[i][j]를 1로 표현합니다.
computer[i][i]는 항상 1입니다.
 *
 *
 *
 *
 * */
import java.util.*;


class Solution {
    public int solution(int n, int[][] computers) {
		ArrayList<HashSet<Integer>> lst = new ArrayList<>();

		for (int i = 0; i < computers.length; i++) {
			for (int j = 0; j < computers[i].length; j++) {
				int from = i;
				int to = j;

                if (computers[i][j] == 1)
    				findNetAndPutOrCreate(lst, from, to);
                // System.out.println(lst);
			}
		}
		return lst.size();
	}

	private void findNetAndPutOrCreate(ArrayList<HashSet<Integer>> lst, int fromNode, int toNode) {
		HashSet<Integer> fromSet = null;
        for (HashSet<Integer> s : lst) {
			if (s.contains(fromNode)) {
				fromSet = s;
                break;
			}
		}
        
        HashSet<Integer> toSet = null;
        for (int i = lst.size() -1; i >= 0; i--) {
			if (lst.get(i).contains(toNode)) {
				toSet = lst.get(i);
                break;
			}
		}
        
        if (fromSet == null && toSet == null) {
            HashSet<Integer> s = new HashSet<>();
            s.add(fromNode);
            s.add(toNode);
            lst.add(s);    
        } else if (fromSet == toSet) {
            fromSet.add(toNode);
        } else if (fromSet == null){
            toSet.add(fromNode);
        } else if (toSet == null) {
            fromSet.add(toNode);
        } else {
            fromSet.addAll(toSet);
            fromSet.add(fromNode);
            fromSet.add(toNode);
            lst.remove(toSet);
        }
        
	}
}
